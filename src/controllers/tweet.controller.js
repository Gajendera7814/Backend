import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    // Check if content is missing or empty
    if (!content || content.trim() === "") {
        throw new ApiError(400,"Content is required");
    }
    
    // Retrieve the user ID from the request object, if available
    const user = req.user?._id;

    // Create a new tweet with the provided content and owner (user)
    const tweet = await Tweet.create(
        { 
            content,
            owner: user
        }
    );

    // Retrieve the newly created tweet from the database
    const createdTweet = await Tweet.findById(tweet._id);
    
    // Check if the tweet was successfully created
    if (!createdTweet) {
        throw new ApiError(500, "Something went wrong while creating the tweet in the database")
    }
    
    // Respond with a success message and the created tweet
    return res.status(201).json(
        new ApiResponse(200, createdTweet, "Your tweet has been posted successfully")
    )
});


const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
});


const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
});


const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
};