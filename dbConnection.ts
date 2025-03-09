import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = "mongodb+srv://master-andy:0923@dev-01.2vohy.mongodb.net/?retryWrites=true&w=majority&appName=dev-01";

export const mongoClient= new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});
