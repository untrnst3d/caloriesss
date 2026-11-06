import hashlib
import io
import warnings
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from database import query
from security import current_user

router = APIRouter(prefix='/api/account')
MAX_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 12_000_000


def account_data(user):
    row = query('SELECT avatar_version FROM users WHERE id=?', (user['id'],))[0]
    return {'avatar_url': '/api/account/avatar?v=' + row['avatar_version'] if row['avatar_version'] else None}


@router.get('')
def get_account(user=Depends(current_user)):
    return account_data(user)


def make_avatar(raw):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise HTTPException(415, 'Выбери фото в формате JPG, PNG или WebP')
                source.load()
                fixed = ImageOps.exif_transpose(source).convert('RGBA')
                background = Image.new('RGB', fixed.size, 'white')
                background.paste(fixed, mask=fixed.getchannel('A'))
                thumb = ImageOps.fit(background, (512, 512), method=Image.Resampling.LANCZOS)
                output = io.BytesIO()
                thumb.save(output, format='JPEG', quality=86)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(422, 'Не удалось прочитать фото. Выбери JPG, PNG или WebP до 12 мегапикселей')


@router.put('/avatar')
async def upload_avatar(request: Request, user=Depends(current_user)):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BYTES:
            raise HTTPException(413, 'Фото должно быть не больше 5 МБ')
    avatar = await run_in_threadpool(make_avatar, bytes(body))
    version = hashlib.sha256(avatar).hexdigest()[:16]
    await run_in_threadpool(query, 'UPDATE users SET avatar=?, avatar_version=? WHERE id=?', (avatar, version, user['id']))
    return await run_in_threadpool(account_data, user)


@router.get('/avatar')
def get_avatar(user=Depends(current_user)):
    blob = query('SELECT avatar FROM users WHERE id=?', (user['id'],))[0]['avatar']
    if not blob:
        raise HTTPException(404, 'Аватарка ещё не добавлена')
    return Response(blob, media_type='image/jpeg', headers={'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})


@router.delete('/avatar')
def delete_avatar(user=Depends(current_user)):
    query("UPDATE users SET avatar=NULL, avatar_version='' WHERE id=?", (user['id'],))
    return account_data(user)
