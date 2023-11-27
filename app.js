const express = require("express");
const cors = require('cors');
const app = express();
const AuthRoute  = require("./routes/auth")
const OtpRoute = require('./routes/verify_otp')
const UserRoute = require("./routes/user")
const ForgotRoute = require("./routes/forgotPin")
require("dotenv").config();


app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cors());


app.listen(process.env.APP_PORT,()=> {
    console.log("Server up and running on PORT : ", process.env.APP_PORT);
});

app.use('/api/auth', AuthRoute)
app.use('/api/verify', OtpRoute)
app.use("/api/user", UserRoute)
app.use("/api/forgot", ForgotRoute)


 