const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5nhokm7.mongodb.net/?retryWrites=true&w=majority`;

function verifyToken(req, res, next) {
  const Authorization = req.headers.authorization;
  console.log(Authorization);
  if (!Authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = Authorization.split(" ")[1];
  jwt.verify(token, process.env.Access_Token_secret, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    
    next();
  });
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// const services = require("./services");

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const servicescollection = database.collection("services");
    const bookingCollections = database.collection("booking");
    const userCollections = database.collection("users");

 

    //verify Admin//

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      
      const requsterAccount = await userCollections.findOne({
        email: requester,
      });
      if (requsterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "unAuthorized access" });
      }
    };

    ///// Get All users

    app.get("/alluser", verifyToken, async (req, res) => {
      const allusers = await userCollections.find().toArray();
      res.send(allusers);
    });

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = servicescollection.find(query);
      const service = await cursor.toArray();
      res.send(service);
    });

    ///Admin:remove a user 
    app.delete('/user/admin/:email',verifyToken,verifyAdmin,async(req,res)=>{
      const email=req.params.email;
      const filter={email:email};
      const result= await userCollections.deleteOne(filter);
      res.send(result)
    })

    //make sure he is admin//
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollections.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    //MAke Admin////

    app.put("/user/admin/:email",verifyToken,verifyAdmin,  async (req, res) => {
      const email = req.params.email;
       const requester = req.decoded.email;
       console.log(requester);
      console.log(email);
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollections.updateOne(filter, updateDoc);
      
      res.send(result)
       
      
    });

    /////send User Data to backend///
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.Access_Token_secret,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date || "Sep 2, 2022";

      //// get all services....
      const services = await servicescollection.find().toArray();
      // step 2 get the booking of that day....

      const query = { date };
      const booking = await bookingCollections.find(query).toArray();

      ////step 3 for each service find bookings for that service
      services.forEach((service) => {
        const serviceBooking = booking.filter(
          (b) => b.treatment === service.name
        );
        const booked = serviceBooking.map((s) => s.slot);
        service.booked = booked;
        const available = service.slots.filter((sr) => !booked.includes(sr));
        service.slots = available;
      });
      res.send(services);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;

      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patientName: booking.patientName,
      };

      const exists = await bookingCollections.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }

      const result = await bookingCollections.insertOne(booking);
      return res.send({ success: true, result });
    });

    ////// Get patient booking query by email///

    app.get("/booking", verifyToken, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const bookings = await bookingCollections.find(query).toArray();
        // console.log(bookings);
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "forbidden" });
      }
    });

    ///Delete Appiontment for user

    app.delete('/AppiontmentDelete/:email',async(req,res)=>{
      const email = req.params.email;
      const filter={email:email}
      const result =await bookingCollections.deleteOne(filter);
      res.send(result)
    })

    //  ////Get all userinfo

    //  app.post("/alluserlist",async(req,res)=>{
    //   const user =req.body;
    //   console.log(user);
    //   res.send(user)
    // })
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
