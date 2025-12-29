const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", require("./routes/auth.routes.js"));
app.use("/api/subjects", require("./routes/subject.routes.js"));
app.use("/api/lectures", require("./routes/lecture.routes.js"));
app.use("/api/notifications", require("./routes/notification.routes.js"));
app.use("/api/references", require("./routes/reference.routes.js"));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Server is running on port 5000");
});

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

app.listen(5000, ()=> {
  console.log("Server running on port 5000");
});
