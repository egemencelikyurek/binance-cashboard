var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
    username: String,
    password: String,
    apikey: String,
    secretkey: String,
    options: {
        APIKEY: String,
        APISECRET: String, 
        useServerTime: Boolean,
        recvWindow: Number,
        verbose: Boolean
    }
    
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);