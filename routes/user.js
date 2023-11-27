const router = require("express").Router()

const { updateUserDetails, DeleteUser } = require('../controllers/userController')
const { checkToken } = require('../helpers/token_validation')

router.patch('/update', checkToken, updateUserDetails);
router.delete('/delete', checkToken, DeleteUser)

module.exports = router