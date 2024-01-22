import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// To handle cors error
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// For processing JSON requests
app.use(express.json({limit: "20kb"}));

// For managing URL-encoded data
app.use(express.urlencoded({ extended: true, limit: "20kb" }));

// Serving static files and folders from the "public" directory
app.use(express.static("public"));

// Enabling cookie access from the server and setting cookies in the browser
app.use(cookieParser());

// routes import
import userRouter from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRouter);

export { app };