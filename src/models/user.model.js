import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"; // A library to help you hash passwords.

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String,  // use cloudinary url
            required: true
        },
        coverImage: {
            type: String
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [ true, "Password is required" ]
        },
        refreshToken: {
            type: String
        }
    },
    { timestamps: true }
);

// it is a event in mongoosedb "save". 
userSchema.pre("save", async function (next) {
    /* Check if the password field is not modified, and if so, skip to the next middleware.
       OR   Bcrypt the password and save it if the password is modified during an update. */
    if(!this.isModified("password")) return next();

    // Hash the user's password using bcrypt with a cost factor of 10
    // Note: bcrypt.hash is an asynchronous function, so it returns a Promise
    this.password = await bcrypt.hash(this.password, 10)
    next();
});

// Define a method to check if the provided password matches the hashed password stored for the user
userSchema.methods.isPasswordCorrect = async function(password) {
    // Use bcrypt.compare to compare the provided password with the hashed password in the database
    return await bcrypt.compare(password, this.password)
};

userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
};

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
};

export const User = mongoose.model("User", userSchema);



/*
    <<<<<<<------*****----- Why "pre" function is mostly used with userSchema while using bcryptjs ? ------******----->>>>>

    The Mongoose Schema API pre() method is used to add a pre-hook to the mongoose Schema methods and can be used 
    to perform pre Schema method operations. 

    when we use bcrypt, we need to hash the password before (pre) add it to the database, so this process done pre-save, 
    not after(post) save, we cannot hash password after save it, it hashed before save


    <<<<<<<<<<<<<<<<-------**************------- why we use jsonwebtoken ---------**************-------->>>>>>>>>>>>>>>>>

    jsonwebtoken is a library commonly used in web development, especially with Node.js, to handle authentication 
    and authorization by generating and verifying JSON Web Tokens (JWT). JWTs are compact, URL-safe means of representing
    claims to be transferred between two parties. Here are some reasons why jsonwebtoken is used:
    - Stateless Authentication
    - Token-Based Authentication
    - Compact and URL-Safe
    - Claims and Payload
    - Cross-Domain Authentication
    - Decentralized Identity
    - Integration with Single Sign-On (SSO) Systems
    - Authorization and Access Control

*/