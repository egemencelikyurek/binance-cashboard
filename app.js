var express = require("express");
var Binance = require("node-binance-api");
var bodyParser = require("body-parser");
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;
var eSession = require("express-session");
var app = express();
var flash = require("connect-flash");
var methodOverride = require("method-override");
var User = require("./models/user");
const mongoose = require("mongoose");
var moment = require("moment");

mongoose.connect("mongodb+srv://egemencelikyurek:xWMdv4v9GHyI24qZ@cluster0.j25ug.mongodb.net/Cashboard?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine","ejs");
app.use(express.static(__dirname + "/public"));
app.use(eSession({
    secret: "3309Em.",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(flash());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    res.locals.warning = req.flash("warning");
    res.locals.moment = moment;
    next();
});
        //APIKEY: 'gdUnPetN3h3rXP9tQ1gOdkvlTHfPTZCqaJaTwGBtqvxCub536IFfKFb9F0WeeFdO',
        // APISECRET: 'xFH6O4KxdjIFJuUQHbDytu6PJoQNAYXraPA6X14MM9tc9hL1Fm5UCJmgGTblN3OD',           
        // APIKEY: 'ifyKy1JxzQtmnQ3DjMzpYmVXunSBlpDSMOMXkka7p7pQxY4D8VVQMYGNo0vpxNeq',
        // APISECRET: '5myHOkS9i3XdxLNND4Ewvp0oDwqOAqO2rjyRUk21RclFfN0LyXROTIBkQDiQdkuo',
app.get("/", function(req, res){
    res.redirect("/login");
});
app.get("/main", isLoggedIn, async function (req, res) {
    const binance = await new Binance().options(req.user.options);
    let balances;
    try {
        balances = await binance.balance();
    } catch (e) {
        console.log(e.body);
    }
    var quantities = Object.values(balances);
    var coinNames = Object.keys(balances);
    var dollarqty = 0;
    var a = [];
    for(var i=0; i < quantities.length; i++){
        // Elimdeki coinler aras??ndan itibari para d??????ndakileri se??
        if(parseFloat(quantities[i].available) + parseFloat(quantities[i].onOrder) > 0 && (coinNames[i] != "USDT") && (coinNames[i] != "BUSD") && (coinNames[i] != "TRY")){
            a.push({
                name: coinNames[i],
                qty: parseFloat(quantities[i].available) + parseFloat(quantities[i].onOrder),
                price: 0
            })
            
        }
        if((coinNames[i] == "USDT") || (coinNames[i] == "BUSD") && parseFloat(quantities[i].available) + parseFloat(quantities[i].onOrder) > 0){
            dollarqty += parseFloat(quantities[i].available) + parseFloat(quantities[i].onOrder);
        }
    }
    var coins = [];
    for (var i = 0; i < a.length; i++) {
        let analyzeedCoin;
        try{
            a[i].price = parseFloat((await binance.prices(a[i].name + "USDT"))[a[i].name + "USDT"]);
        }
        catch (e){
            try{
                a[i].price = parseFloat((await binance.prices(a[i].name + "BUSD"))[a[i].name + "BUSD"]);
                console.log(e.body)
            }
            catch (a){
                console.log(a.body);
            }
        }
        try {
            analyzeedCoin = await analyzee(a[i].name, a[i].price, a[i].qty, binance);
            a[i].avgCost = analyzeedCoin.avgCost;
            a[i].profit = analyzeedCoin.profit;
            a[i].inWallet = analyzeedCoin.inWallet;
            coins.push(a[i]);
        } catch (e) {
            console.log(e.body);
        }
    }
    var totalblnc = 0;
    for(var i=0; i<coins.length; i++){
        totalblnc += coins[i].qty * coins[i].price;
    }
    var totalBalance = totalblnc + dollarqty;
    res.render("index", { coins: coins, totalBalance: totalBalance});
    return 0;

});

app.get("/main/:id", isLoggedIn, async function(req, res){
    const binance = await new Binance().options(req.user.options);
    var coinName = req.params.id;
    let balances = await binance.balance();
    let price;
    try{
        price = parseFloat(Object.values(await binance.prices((coinName + "USDT") || (coinName + "BUSD")))[0]);
    }
    catch(e){
        console.log(e.body);
    }
    var index = Object.keys(balances).indexOf(coinName);
    var obj = Object.values(balances)[index];
    var quantity = parseFloat(obj.available) + parseFloat(obj.onOrder);
    let coin = await analyzee(coinName, price, quantity, binance);
    res.render("result", {coin: coin});
});
async function analyzee(tek, price, quantity, binance) {
    var cumulativeLot = 0; var totalCost = 0; var avgCost = 0; var totalBuy = 0; var totalSell = 0; var realProfit; var inWallet; var profit;
    let tradesUSDT = [];
    let tradesBUSD = [];
    try{
        tradesUSDT = await binance.trades(tek + "USDT");
    }
    catch (e){
        console.log(e.body);
    }
    try{
        tradesBUSD = await binance.trades(tek + "BUSD");
    }
    catch (e){
        console.log(e.body);
    }
    let unsortedTrades;
    if(tradesBUSD != undefined){
        unsortedTrades = tradesUSDT.concat(tradesBUSD);
    }else{
        unsortedTrades = tradesUSDT;
    }
    const trades = await unsortedTrades.sort((a, b) => {
        return parseFloat(a.time) - parseFloat(b.time);
    });
    var coin = {
        first: tek,
        avgCost: 0,
        totalBuy: 0,
        totalSell: 0,
        realProfit: 0,
        inWallet: 0,
        quantityWallet: quantity,
        profit: 0,       
        price: price,
        currentBuy: 0,
        currentSell: 0,
        trades: []
    }
    var currentBuy = 0;
    var currentSell = 0;
    for(var i= 0; i<trades.length; i++){
        if(trades[i].isBuyer){
            // AVG calculation
            cumulativeLot += parseFloat(trades[i].qty);
            totalCost += parseFloat(trades[i].qty) * parseFloat(trades[i].price);
            avgCost = totalCost / cumulativeLot;
            // For profit calculation            
            totalBuy += parseFloat(trades[i].quoteQty);
            currentBuy += parseFloat(trades[i].quoteQty);
        }else{
            // AVG calculation
            cumulativeLot -= parseFloat(trades[i].qty);
            totalCost -= avgCost * parseFloat(trades[i].qty);
            // For profit calculation
            totalSell += parseFloat(trades[i].quoteQty);
            currentSell += parseFloat(trades[i].quoteQty)
        }
        var d = moment(trades[i].time);
        var eachtrade = {
            time: d,
            symbol: trades[i].symbol,
            isBuyer: trades[i].isBuyer ? "AL" : "SAT",
            price: trades[i].price,
            qty: trades[i].qty,
            quoteQty: trades[i].quoteQty + "USD",
            cumulativeLot: cumulativeLot,
            cumulativeMoney: currentBuy-currentSell
        }
        coin.trades.push(eachtrade);
        
    }
    realProfit = totalSell - totalBuy;
    inWallet = price * quantity;
    profit = realProfit + inWallet;
    
    coin.first = tek;
    coin.avgCost = avgCost;
    coin.totalBuy = totalBuy;
    coin.totalSell = totalSell;
    coin.realProfit = realProfit;
    coin.inWallet = inWallet;
    coin.profit = profit;
    coin.currentBuy = currentBuy;
    coin.currentSell = currentSell;
    return coin; 
}
async function analyze(cift) {
    var cumulativeLot = 0; var totalCost = 0; var avgCost = 0; var totalBuy = 0; var totalSell = 0; var realProfit; var inWallet; var profit;
    var first = cift.split("_")[0];
    var second = cift.split("_")[1];   
    let trades = await binance.trades(first+second);
    for(var i= 0; i<trades.length; i++){
        if(trades[i].isBuyer){
            cumulativeLot += parseFloat(trades[i].qty);
            totalCost += parseFloat(trades[i].qty) * parseFloat(trades[i].price);
            totalBuy += parseFloat(trades[i].qty) * parseFloat(trades[i].price);
            avgCost = totalCost / cumulativeLot;
        }else{
            cumulativeLot -= parseFloat(trades[i].qty);
            totalCost -= avgCost * parseFloat(trades[i].qty);
            totalSell += parseFloat(trades[i].qty) * parseFloat(trades[i].price);
        }
    }
    realProfit = totalSell - totalBuy;
    let balances = await binance.balance();
    let ticker = await binance.prices(first+second);
    var price = parseFloat(Object.values(ticker)[0]);
    var index = Object.keys(balances).indexOf(first);
    var obj = Object.values(balances)[index];
    inWallet = price * (parseFloat(obj.available) + parseFloat(obj.onOrder));
    profit = realProfit + inWallet;
    var coin = {
        first: first,
        second: second,
        avgCost: avgCost,
        totalBuy: totalBuy,
        totalSell: totalSell,
        realProfit: realProfit,
        inWallet: inWallet,
        profit: profit,       
        price: price 
    }
   
    return coin; 
}
// AUTH ROUTES
// Show Signup Form
app.get("/register", function (req, res) {
    res.render("register");
});
// Register
app.post("/register", function (req, res) {
    if (req.body.password == req.body.passwordRepeat) {
        var newUser = new User({ username: req.body.username, options: {
            APIKEY: req.body.apikey,
            APISECRET: req.body.secretkey, 
            useServerTime: true,
            recvWindow: 60000, 
            verbose: true, 
        } });
        User.register(newUser, req.body.password, function (err, user) {
            if (err) {
                console.log(err);
                res.render("register");
            }
            else {
                passport.authenticate("local")(req, res, function () {
                    res.redirect("/main");
                });
            }
        });

    } else {
        req.flash("error", "??ifreleriniz ayn?? de??il. L??tfen tekrar deneyiniz.");
        res.redirect("/register");
    }
});
// Show Login Page
app.get("/login", function (req, res) {
    if(req.isUnauthenticated()){
        res.render("login");
    }else{
        res.send("Zaten giri?? yapt??n??z. Devam etmek i??in <a href='/main'>t??klay??n??z</a>")
    }
});
// Login
app.post("/login", passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/login",
    failureFlash: true,
}), function (req, res) {
});
// Logout
app.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "Ba??ar??yla ????k???? yapt??n??z.")
    res.redirect("/login");
});
// MiddleWare
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    }
    else {
        req.flash("error", "Bu sayfay?? g??r??nt??leme yetkiniz yok. L??tfen giri?? yap??n.")
        res.redirect("/login");
    }
}
var port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server Has Started!");
});
