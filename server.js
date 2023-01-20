import express from "express";

const PORT = 80;

const app = express();

app.use(express.static("dist"));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
