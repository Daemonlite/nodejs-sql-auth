const router = require('express').Router()
const { verifyOtp, resendOtp } = require('../controllers/otpController')

router.post('/verifyOtp', verifyOtp)
router.patch('/resendOtp', resendOtp)

module.exports = router