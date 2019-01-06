'use strict'

const request = require('request-promise-native')
const resErr = require('./res-err')

const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time))

const getSleepTime = tries => 500 + 2000 * tries

const maxTries = 5

module.exports = (b2KeyId, b2KeyValue) => {
  const cachedData = {
    apiHost: 'https://api.backblazeb2.com',
    downloadHost: null,
    token: null,
  }

  let flyingRefresh = null
  const refreshAuthToken = () => {
    if (flyingRefresh !== null) {
      return flyingRefresh
    }
    flyingRefresh = (async () => {
      const res = await requestB2({
        op: 'b2_authorize_account',
        idempotent: true,
        customHeaders: {
          authorization: 'Basic ' + Buffer.from(`${b2KeyId}:${b2KeyValue}`, 'utf8').toString('base64'),
        },
      })
      if (res.status !== 200) {
        throw resErr(res)
      }
      cachedData.apiHost = res.body.apiUrl
      cachedData.downloadHost = res.body.downloadUrl
      cachedData.token = res.body.authorizationToken
    })()
    return flyingRefresh
  }

  const getAuthToken = async () => {
    if (cachedData.token === null) {
      await refreshAuthToken()
    }
    return cachedData.token
  }
  
  const requestB2 = ({
    op,
    customUrl,
    sendAuth = false,
    idempotent = false,
    method = 'GET',
    json,
    body,
    customHeaders = {},
  }) => {
    const sendRequest = async (tries) => {
      let bodyBuffer = body
      if (json !== undefined && body === undefined) {
        bodyBuffer = Buffer.from(JSON.stringify(json), 'utf8')
      }
      const headers = {
        'user-agent': 'micro (https://github.com/ginkoid/micro)',
        'content-type': 'application/json',
      }
      if (sendAuth) {
        headers.authorization = await getAuthToken()
      }
      let fullResponse
      try {
        fullResponse = await request({
          simple: false,
          resolveWithFullResponse: true,
          url: customUrl === undefined ? `${cachedData.apiHost}/b2api/v2/${op}` : customUrl,
          method,
          body: bodyBuffer,
          headers: { ...headers, ...customHeaders },
        })
      } catch (e) {
        if (!idempotent || tries >= maxTries) {
          throw new Error('http request error')
        }
        await sleep(getSleepTime(tries))
        return sendRequest(tries + 1)
      }
      const res = {
        status: fullResponse.statusCode,
        headers: fullResponse.headers,
      }
      try {
        res.body = JSON.parse(fullResponse.body)
      } catch (e) {}

      if ([429, 408, 500, 503].includes(res.status)) {
        if (!idempotent || tries >= maxTries) {
          throw resErr(res)
        }
        let sleepTime = parseInt(res.headers['retry-after'])
        if (Number.isNaN(sleepTime)) {
          sleepTime = getSleepTime(tries)
        }
        await sleep(sleepTime)
        return sendRequest(tries + 1)
      }

      if (sendAuth && res.status === 401 && (res.body.code === 'expired_auth_token' || res.body.code === 'bad_auth_token')) {
        await refreshAuthToken()
        return sendRequest(tries + 1)
      }

      return res
    }
    return sendRequest(0)
  }
  
  return {
    req: requestB2,
    getCachedData: async () => {
      if (cachedData.token === null) {
        await refreshAuthToken()
      }
      return cachedData
    },
  }
}
