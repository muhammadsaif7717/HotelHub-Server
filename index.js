const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const dotenv = require("dotenv");
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;


//custom midleweres
const logger = async (req, res, next) => {
  console.log('Called', req.host, req.originalUrl)
  next();
}

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('Value of the token in middlewere', token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    console.log('value in the token', decoded);
    req.user = decoded;
    next();
  })
}


//middlewere's
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());











// manage detabase
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oh0s98i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookeOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' ? true : false,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();  //comment this line before deploy in varcel

    //collections
    const userCollection = client.db("hotelHubDB").collection("users");
    const roomsCollection = client.db("hotelHubDB").collection("rooms");
    const bookingsCollection = client.db("hotelHubDB").collection("bookings");

    //?!operations//

    //AUTH related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res
        .cookie('token', token, cookeOption)
        .send({ success: true })
    })

    //user logout 
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user)
      res.clearCookie('token', { ...cookeOption, maxAge: 0 }).send({ success: true })
    })


    // GET all rooms
    app.get('/rooms', async (req, res) => {
      res.send(await roomsCollection.find({}).toArray());
    });
    // GET a specific room 
    app.get('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    // update a specefic room after booking
    app.patch('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedRoom = req.body;

      const room = {
        $set: {
          availability: updatedRoom.availability,
          bookedDate: updatedRoom.bookedDate,
        }
      }
      const result = await roomsCollection.updateOne(filter, room, options);
      res.send(result)
    })



    // post bookings
    app.post('/bookings', async (req, res) => {
      res.send(await bookingsCollection.insertOne(req.body))
    })
    // get bookings
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log("Token owner info", req.user)
      if (req.user.email !== req.query.email) {
        return res.status(401).send({ message: 'Forbidden Access' });
      }
      let query = {}
      if (req.query?.email) {
        query = { email: req.query?.email }
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result)
    })
    // get a specific booking
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.findOne(query);
      res.send(result)
    })
    //update a specific booking
    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const bookDate = {
        $set: {
          bookedDate: updatedBooking.bookedDate,
        }
      }
      const result = await bookingsCollection.updateOne(filter, bookDate, options);
      res.send(result);
    });
    //delete specific booking
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });



    // update a specific rooms review
    app.put('/rooms/:id/reviews', async (req, res) => {
      const id = req.params.id;
      const review = req.body;

      const filter = { _id: new ObjectId(id) };
      const update = {
        $push: { reviews: review } // Append the new review to the reviews array
      };

      try {
        const result = await roomsCollection.updateOne(filter, update);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Failed to update reviews' });
      }
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });  //comment this line before deploy in varcel
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
