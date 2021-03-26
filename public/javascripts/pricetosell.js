var pricetosell = document.querySelector("#pricetosell");
var avgCost = document.querySelector("#avgcost");

document.querySelector("#percent").addEventListener("change", myFunction);
function myFunction(){
    pricetosell.textContent = (parseFloat(avgCost.innerText) * (1 + parseFloat(document.querySelector("#percent").value/100))).toFixed(6);
} 

