const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
	res.render('index', {
		title: 'Home',
		currentPage: 'home',
		message: 'STEM-ACT landing page'
	});
});

app.listen(PORT, () => {
	console.log(`Running STEM-ACT site at http://localhost:${PORT}`);
});
