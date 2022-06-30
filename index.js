import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

const client = axios.create({ baseURL: process.env.APP_URL + '/api/v8' });

if (!process.env.APP_TOKEN || process.env.APP_TOKEN === '') {
    const authorize = await client.post('/login/authorize/', {
        'app_id': process.env.APP_ID,
        'app_name': process.env.APP_NAME,
        'app_version': process.env.APP_VERSION,
        'device_name': process.env.DEVICE_NAME
    });
    if (!authorize.data.success) {
        console.log(`une erreur est survenue : ${authorize.data.error_code}`);
        process.exit(1);
    }
    console.log('Veuillez confirmer sur l\'ecran de votre freebox');
    let status = 'pending';
    setInterval(async () => {
        const track = await client.get(`/login/authorize/${authorize.data.result.track_id}`);
        if (!track.data.success) {
            console.log(`une erreur est survenue : ${track.data.error_code}`);
            process.exit(1);
        }
        status = track.data.result.status;
        if (status !== 'pending') {
            if (status === 'granted') {
                console.log(`Vous êtes parfaitement authentifié : ${authorize.data.result.app_token}`);
                console.log('Veuillez sauvegarder ce token en le mettant dans le fichier .env sous APP_TOKEN');
                process.exit(0);
            }
            console.log(`Une erreur s'est produite avec le code d'erreur : ${status}`);
            process.exit(1);
        }
    }, 1000);
}
else {
    const login = await client.get('/login/');
    if (!login.data.success) {
        console.log(`une erreur est survenue : ${login.data.error_code}`);
        process.exit(1);
    }
    const session = await client.post('/login/session/', {
        'app_id': process.env.APP_ID,
        'password': crypto.createHmac('sha1', process.env.APP_TOKEN).update(login.data.result.challenge).digest('hex'),
    });
    if (!session.data.success) {
        console.log(`une erreur est survenue : ${session.data.error_code}`);
        process.exit(1);
    }
    console.log('Started');
    let latest = 0;
    setInterval(async () => {
        const calls = await client.get('/call/log/', { headers: { 'X-Fbx-App-Auth': session.data.result.session_token } });
        if (!calls.data.success) {
            console.log(`une erreur est survenue : ${track.data.error_code}`);
            process.exit(1);
        }
        if (calls.data.result[0].duration === 0 && calls.data.result[0].id !== latest && calls.data.result[0].type === 'accepted') {
            latest = calls.data.result[0].id;
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                'chat_id': process.env.TELEGRAM_CHAT_ID,
                'text': `Appel entrant de ${calls.data.result[0].name}`,
            });
        }
    }, 2000);
}