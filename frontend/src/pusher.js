import Pusher from 'pusher-js';

const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY || 'bda8ea28bfadc8c022a7', {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap1',
});

export default pusher;
