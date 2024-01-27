import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";


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
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    refreshToken: undefined
                }
            },
            {
                new: true
            }
        )
    
        const options = {
            httpOnly: true,
            secure: true
        };
    
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
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
    
        const user = await User.findById(decodedToken?._id);
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        };
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});


const changeCurrentPassword = asyncHandler(async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(req.user?._id);
    
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    
        if (!isPasswordCorrect) {
            throw new ApiError(400, "Invalid password");
        }
    
        // To set newPassword
        user.password = newPassword
    
        // save in our database
        const newUpdatedpassword = await user.save({ validateBeforeSave: false });
    
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
        return res.status(200).json(200, req.user, "current user fetched successfully");
    } catch (error) {
        throw new ApiError(401, error?.message || "User not fetched");
    }
});


const updateAccountDetails = asyncHandler(async (req, res) => {
    try {
        const { fullName, email, username } = req.body;

        if (!fullName || !email || !username) {
            throw new ApiError(400, "All fields are required");
        }

        const updatedDetails = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullName,
                    email,
                    username
                }
            },
            { new: true }
        ).select("-password")

        return res.status(200).json(new ApiResponse(200, updatedDetails, "User account details updated successfully"));
    } catch (error) {
        throw new ApiError(401, error?.message || "Account details not updated");
    }
});


const updateUserAvatar = asyncHandler(async (req, res) => {
    try {
        const avatarLocalPath = req.file?.path;

        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is missing");
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath);

        if (!avatar.url) {
            throw new ApiError(400, "Error while uploading on avatar");
        }

        // update avatar field
        const updateAvatar = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            { new: true }
        ).select("-password");

        return res.status(200).json(new ApiResponse(200, updateAvatar, "Avatar updated successfully"));
    } catch (error) {
        throw new ApiError(401, "Avatar not updated");
    }
});


const updateCoverImage = asyncHandler(async (req, res) => {
    try {
        const coverImageLocalPath = req.file?.path;

        if (!coverImageLocalPath) {
            throw new ApiError(400, "Cover image file is missing");
        }

        const coverImage = await uploadOnCloudinary(avatarLocalPath);

        if (!coverImage.url) {
            throw new ApiError(400, "Error while uploading on cover image");
        }

        // update coverImage field
        const updateCoverImage = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            { new: true }
        ).select("-password");

        return res.status(200).json(new ApiResponse(200, updateCoverImage, "Cover Image updated successfully"));
    } catch (error) {
        throw new ApiError(401, "Cover image not updated");
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
    updateCoverImage
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