'use strict'

const os = require('os')
const dotenv = require('dotenv')
dotenv.config({
  path: os.homedir() + '/.micro-env'
})
const fs = require('fs')
const crypto = require('crypto')
const mime = require('mime')
const chalk = require('chalk')
const makeReq = require('./req')
const resErr = require('./res-err')

process.on('unhandledRejection', (e) => {
  throw e
})

const maxTries = 5

const bucketPrefix = 'm/'

const encodeBase64Url = (buf) => {
  const base64 = buf.toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

;(async () => {
  const req = makeReq(process.env.MICRO_B2_KEY_ID, process.env.MICRO_B2_KEY_VALUE)
  
  const filePath = process.argv[2]

  if (filePath === undefined || filePath === '') {
    console.log('help:\n  micro /path/to/file/to/upload')
    return
  }

  let fileContents

  try {
    fileContents = fs.readFileSync(filePath)
  } catch (e) {
    console.error('couldn\'t read file,', e.message)
    return
  }
  
  const fileSha1Hash = crypto.createHash('sha1').update(fileContents).digest('hex')
  const fileMd5Hash = encodeBase64Url(crypto.createHash('md5').update(fileContents).digest(null))

  const extensionFileMime = mime.getType(filePath)

  const logUploadResult = (exists) => console.log(chalk`${exists
    ? chalk`{green file already exists}`
    : chalk`{green uploaded!}`}
path:  {cyan ${process.env.MICRO_B2_BUCKET_NAME}/${bucketPrefix}${fileMd5Hash}}
size:  {cyan ${fileContents.length} bytes}
url:   {yellow ${process.env.MICRO_FILE_ORIGIN}/${encodeURIComponent(fileMd5Hash)}}`)

  const checkRes = await req.req({
    customUrl: `${(await req.getCachedData()).downloadHost}/file/${process.env.MICRO_B2_BUCKET_NAME}/${bucketPrefix}${fileMd5Hash}`,
    sendAuth: true,
    idempotent: true,
    method: 'HEAD',
  })

  if (checkRes.status === 200) {
    logUploadResult(true)
    return
  }

  const attemptUpload = async (tries) => {
    const urlRes = await req.req({
      op: 'b2_get_upload_url',
      sendAuth: true,
      idempotent: true,
      method: 'POST',
      json: {
        bucketId: process.env.MICRO_B2_BUCKET_ID,
      },
    })

    if (urlRes.status !== 200) {
      if (tries >= maxTries) {
        throw resErr(urlRes)
      } else {
        return attemptUpload(tries + 1)
      }
    }


    const uploadRes = await req.req({
      customUrl: urlRes.body.uploadUrl,
      method: 'POST',
      body: fileContents,
      customHeaders: {
        'authorization': urlRes.body.authorizationToken,
        'x-bz-file-name': encodeURIComponent(bucketPrefix + fileMd5Hash),
        'content-type': extensionFileMime === null ? 'application/octet-stream' : extensionFileMime,
        'content-length': fileContents.length,
        'x-bz-content-sha1': fileSha1Hash,
      },
    })

    if (uploadRes.status !== 200) {
      if (tries >= maxTries) {
        throw resErr(uploadRes)
      } else {
        return attemptUpload(tries + 1)
      }
    }

    logUploadResult(false)
  }

  attemptUpload(0)  
})()
