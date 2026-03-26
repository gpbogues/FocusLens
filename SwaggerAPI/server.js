import express from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app = express();

//Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FocusLens API",
      version: "1.0.0",
      description: "Backend API for FocusLens user authentication",
    },
    servers: [{ url: "http://100.27.212.225:5000" }],
  },
  apis: ["./routes.js"], //reads API definitions from routes.js
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Swagger docs running at http://localhost:${PORT}`);
});