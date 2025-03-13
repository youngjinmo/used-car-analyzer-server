import express from 'express';
import router from './routes';

const app = express();
const port = 3000;

app.use('/api', router);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
