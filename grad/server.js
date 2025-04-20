//this file is for node.js, communication between frontend & backend
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 5000; //backend port, frontend is 5500
app.use(cors());
app.use(express.json());

app.listen(5000,()=> console.log("server running on port 5000"))

