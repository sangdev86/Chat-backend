const express = require("express");

const config = require("./config/app");

const router = require("./router");

const app = express();

const bodyParser = require("body-parser");

const cors = require("cors");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(router);
app.use(express.static(__dirname + "/public"));

const port = config.appPort;

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

console.log("Hello world");
