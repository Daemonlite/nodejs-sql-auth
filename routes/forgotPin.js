const router = require('express').Router()
const { forgotPin, resetPin } = require('../controllers/forgotController')

router.post('/forgotpin', forgotPin)
router.post('/resetpin', resetPin)

module.exports = router