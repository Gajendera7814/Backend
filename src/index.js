// require('dotenv').config({path: './env'});
import dotenv from "dotenv";
import connectDB from "./db/connection.js";


dotenv.config({
    path: './env'
});

connectDB();


/*
<<<<<<<<<<---------------------------------------------- Approach - 1 ----------------------------------------------->>>>>>>>>>>>>>>

In index.js file

import mongoose from "mongoose";
import { DB_NAME } from "./constants";

import express from "express";
const app = express();

// Use IIFE concept to connect DataBase
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${ DB_NAME }`);
        app.on("error", (error) => {
            console.log("ERROR", error);
            throw error;
        });
        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.log("ERROR", error)
        throw error; 
    }
})();

*/