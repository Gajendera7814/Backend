import mongoose, {Schema} from "mongoose";
import { mongooseAggregatePaginate } from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String,  // use cloudinary url
            required: true
        },
        thumbnail: {
            type: String,  // use cloudinary url
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: Schema.Types.ObjectId,
        ref: "User"
    },
    { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);


/*
    -->> why we use mongoose-aggregate-paginate-v2

    mongoose-aggregate-paginate-v2 is a plugin for Mongoose, which is an Object Data Modeling (ODM) library for 
    MongoDB and Node.js. This plugin is used to enable pagination support for queries that involve the aggregation 
    framework in MongoDB. The aggregation framework allows you to process data and transform it in various ways, 
    and it's often used for complex queries.

*/