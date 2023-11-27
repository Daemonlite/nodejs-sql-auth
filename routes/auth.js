const router = require("express").Router();

const { RegisterUser, loginUser,logOut} = require('../controllers/authController');
const {checkToken} = require('../helpers/token_validation')
router.post("/register", RegisterUser);
router.post("/login", loginUser);
router.post('/logout',checkToken,logOut)


module.exports = router;