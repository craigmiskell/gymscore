const bootstrap = require("bootstrap");
//Alternatively, more carefully:
//import { Tooltip, Toast, Popover } from 'bootstrap';

require("bootstrap/dist/css/bootstrap.min.css");

console.log("Hello from Renderer!");
let $ = require("jquery");

console.log($.fn.jquery);
console.log(bootstrap);
