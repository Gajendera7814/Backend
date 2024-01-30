import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";
import mongoose from "mongoose";


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // store refreshToken inside a user object
        user.refreshToken = refreshToken

        // save the data in our db
        await user.save({ validateBeforeSave: false });

        // The refreshToken is stored in our database, and subsequently, the accessToken and refreshToken are returned.
        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
};


const registerUser = asyncHandler( async (req, res) => {
    try {
        // get user details from frontend
        const { username, email, fullName, password } = req.body;

        // validation - not empty
        if(
            [ username, email, fullName, password ].some((field) => field?.trim() === "")
        ) {
            throw new ApiError(400, "All fields are required")
        }

        // check if user already exists: username, email
        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existedUser) {
            throw new ApiError(409, "User with email or username already exists");
        }

        // check for images, check for avatar
        const avatarLocalPath = req.files?.avatar[0]?.path;

        // when we can't pass coverImage in postman then it throw an error so resolve this issue by using if condition
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
        // check in classic way
        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
            coverImageLocalPath = req.files.coverImage[0].path
        }

        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is required");
        }

        // upload them to cloudinary, avatar
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!avatar) {
            throw new ApiError(400, "Avatar file is required");
        }

        // create user object - create entry in db
        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        });

        // remove password and refresh token field from responce
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"  // Exclude sensitive information such as password and refreshToken from the selected fields.
        );

        // check for user creation
        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user");
        }

        // return res
        return res.status(201).json(
            new ApiResponse(200, createdUser, "User registered Successfully")
        );
    } catch (error) {
        new ApiResponse(401, error?.message || "User not registered");
    }
});


const loginUser = asyncHandler( async (req, res) => {
    try {
        // Extract user credentials from the request body
        const { email, username, password } = req.body;

        // validation - not empty
        if (!username && !email) {
            throw new ApiError(400, "username or email is required");
        }

        // check if user already exists: username, email
        const user = await User.findOne({
            $or: [{username}, {email}]
        })

        if (!user) {
            throw new ApiError(404, "User does not exist");
        }

        // Verify the password in stored database.
        const isPasswordValid = await user.isPasswordCorrect(password);

        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid user credentials");
        }

        // Generate both access and refresh tokens.
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

        // Transmit the token by using cookies.
        const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        const options = {
            // Can only be modified by the server, not the frontend
            httpOnly: true,
            secure: true
        };

        // cookie syntax :-  cookie(key, value, options)
        // To set accessToken and refreshToken cookie
        // To send json object :- json(new ApiError(200, { user: loggedInUser, accessToken, refreshToken }, "User logged In Successfully"))
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, 
                { 
                    user: loggedInUser, accessToken, refreshToken 
                }, 
                "User logged In Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "User not loggedIn");
    }
});


const logoutUser = asyncHandler( async (req, res) => {
    try {
        // Update the user's document in the database to set refreshToken to undefined
        await User.findByIdAndUpdate(
            req.user._id,  // Find user by _id stored in the request
            {
                $unset: {
                    refreshToken: 1  // this removes the field from document
                }
            },
            {
                new: true  // Ensure the updated document is returned
            }
        )
    
        // Define options for cookies
        const options = {
            httpOnly: true,  // Restrict cookie access to HTTP requests only
            secure: true     // Require HTTPS protocol for secure transmission
        };
    
        // Respond with status 200, clear cookies, and send a success message
        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
    } catch (error) {
        throw new ApiError(401, error?.message || "User not logged out");
    }
});


const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        // Retrieve the refreshToken from either cookies or request body
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        // If no refreshToken is provided, throw an unauthorized error
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }
    
        // Verify the incoming refresh token using the secret key
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
    
        // Find the user associated with the decoded token's _id
        const user = await User.findById(decodedToken?._id);
    
        // If no user is found, throw an error indicating an invalid refresh token
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        // Check if the incoming refresh token matches the user's refreshToken
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        // Define options for cookies
        const options = {
            httpOnly: true,  // Restrict cookie access to HTTP requests only
            secure: true     // Require HTTPS protocol for secure transmission
        };
    
        // Generate new access and refresh tokens for the user
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
    
        // Return a JSON response with new tokens and a success message
        return res.status(200)
        .cookie("accessToken", accessToken, options)  // Set accessToken cookie
        .cookie("refreshToken", newRefreshToken, options)  // Set refreshToken cookie
        .json(
            new ApiResponse(200,
                { accessToken, refreshToken: newRefreshToken },  // Include new tokens in the response
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});


const changeCurrentPassword = asyncHandler(async (req, res) => {
    try {
        // Destructure oldPassword and newPassword from the request body
        const { oldPassword, newPassword } = req.body;

        // Find the user by _id stored in the request
        const user = await User.findById(req.user?._id);
    
        // Check if the old password provided matches the user's current password
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    
        // If the old password is incorrect, throw an error
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Invalid password");
        }
    
        // Set the user's password to the new password
        user.password = newPassword
    
        // Save the updated password in the database
        const newUpdatedpassword = await user.save({ validateBeforeSave: false });
    
        // Return a JSON response indicating successful password change
        return res.status(200)
        .json(
            new ApiResponse(200, 
                { newPassword: newUpdatedpassword },
                "Password changed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Password not updated");
    }
});


const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        // Return a JSON response with status 200, containing the current user and success message
        return res.status(200).json(new ApiResponse(200, req.user, "current user fetched successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "User not fetched");
    }
});


const updateAccountDetails = asyncHandler(async (req, res) => {
    try {
        // Destructure fullName, email, and username from the request body
        const { fullName, email, username } = req.body;

        // Check if any required fields are missing
        if (!fullName || !email || !username) {
            throw new ApiError(400, "All fields are required");
        }

        // Update user details in the database and retrieve the updated details
        const updatedDetails = await User.findByIdAndUpdate(
            req.user?._id,  // Find user by _id stored in the request
            {
                $set: {
                    fullName,
                    email,
                    username
                }
            },
            { new: true }  // Ensure the updated document is returned
        ).select("-password")  // Exclude the password field from the returned document

        return res.status(200).json(new ApiResponse(200, updatedDetails, "User account details updated successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Account details not updated");
    }
});


const updateUserAvatar = asyncHandler(async (req, res) => {
    try {
        // Retrieve the local path of the uploaded avatar file from the request
        const avatarLocalPath = req.file?.path;

        // If the avatar file is missing, throw an error
        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is missing");
        }

        // Upload the avatar file to Cloudinary
        const avatar = await uploadOnCloudinary(avatarLocalPath);

        // If there's an error while uploading the avatar, throw an error
        if (!avatar.url) {
            throw new ApiError(400, "Error while uploading on avatar");
        }

        // Update the user's avatar field in the database with the Cloudinary URL
        const updateAvatar = await User.findByIdAndUpdate(
            req.user?._id,  // Find user by _id stored in the request
            {
                $set: {
                    avatar: avatar.url  // Set the avatar field to the Cloudinary URL
                }
            },
            { new: true }  // Ensure the updated document is returned
        ).select("-password");  // Exclude the password field from the returned document

        return res.status(200).json(new ApiResponse(200, updateAvatar, "Avatar updated successfully"));
    } catch (error) {
        throw new ApiError(401, "Avatar not updated");
    }
});


const updateUserCoverImage = asyncHandler(async(req, res) => {
    try {
        // Retrieve the local path of the uploaded cover image file from the request
        const coverImageLocalPath = req.file?.path;

        // If the cover image file is missing, throw an error
        if (!coverImageLocalPath) {
            throw new ApiError(400, "Cover image file is missing");
        }

        // Upload the cover image file to Cloudinary
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        if (!coverImage.url) {
            throw new ApiError(400, "Error while uploading on avatar"); 
        }

        // If there's an error while uploading the cover image, throw an error
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    coverImage: coverImage.url  // Set the coverImage field to the Cloudinary URL
                }
            },
            {new: true}  // Ensure the updated document is returned
        ).select("-password");  // Exclude the password field from the returned document

        return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Cover image not updated");
    }
});


const getUserChannelProfile = asyncHandler(async (req, res) => {
    try {
        // Extracting username from request parameters
        const { username } = req.params;

        // Checking if username is missing or empty
        if (!username?.trim()) {
            throw new ApiError(400, "username is missing");
        }

        // Aggregation pipelines to fetch user channel profile
        const channel = await User.aggregate([
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                // Performing a lookup to get subscribers of the channel
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                // Performing a lookup to get channels subscribed by the user
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                // Adding fields to the document
                $addFields: {
                    // Counting the number of subscribers
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    // Counting the number of channels subscribed to by the user
                    channelsSubscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    // Checking if the user is subscribed to the channel
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelsSubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
                }
            }
        ]);

        // If channel does not exist
        if (!channel?.length) {
            throw new ApiError(404, "channel does not exists")
        }

        return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "User channel not fetched");
    }
});


const getWatchHistory = asyncHandler(async (req, res) => {
    try {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    // sub pipelines
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]);
    
        return res.status(200).json(
            new ApiResponse(200, 
                user[0].watchHistory, 
                "Watch history fetched successfully"
            )
        );
    } catch (error) {
        throw new ApiError(401, error?.message || "Watch history not fetched");
    }
});


export { 
    registerUser, 
    loginUser, 
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};




/*
    <<<<<<<<<<<-------------------------- User Registration Logic --------------------------->>>>>>>>>>>
        - get user details from frontend
        - validation - not empty
        - check if user already exists: username, email
        - check for images, check for avatar
        - upload them to cloudinary, avatar
        - create user object - create entry in db
        - remove password and refresh token field from responce
        - check for user creation
        - return res
    <<<<<<<<<<<-----------------------------*******************------------------------------>>>>>>>>>>>


    <<<<<<<<<<<------------------------------ Login User Logic ------------------------------>>>>>>>>>>>
        - Extract user credentials from the request body
        - username and email
        - Search for the user in our database.
        - Verify the password in stored database.
        - Generate both access and refresh tokens.
        - Transmit the token by using cookies.
    <<<<<<<<<<<-----------------------------*******************------------------------------>>>>>>>>>>>


    <<<<<<<<<<<----------------------------- Logout User Logic ------------------------------>>>>>>>>>>>
        - first clearing the cookie
        - remove the refresh token
    <<<<<<<<<<<-----------------------------*******************------------------------------>>>>>>>>>>>


    ?.  --->>> Optionally Unrapped
*/