import express from 'express';

const app = express();

app.get('/status', (req, res) => {
  res.status(200).send('Hello, World!');
});

export default app;
