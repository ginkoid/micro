'use strict'

const resErr = (res) => {
  console.error('error requesting b2, status:', res.status, 'code:', res.body.code, 'message:', res.body.message)
  return new Error('b2 error')
}

module.exports = resErr
