var pricetosell = document.querySelector("#pricetosell");
var avgCost = document.querySelector("#avgcost");
pricetosell.value = (parseFloat(avgCost.innerText) * (1 + parseFloat(document.querySelector("#percent").value/100))).toFixed(6);
document.querySelector("#percent").addEventListener("change", myFunction);
function myFunction(){
    pricetosell.value = (parseFloat(avgCost.innerText) * (1 + parseFloat(document.querySelector("#percent").value/100))).toFixed(6);
} 

