import toast from 'react-hot-toast';

const toastStyle = {
  fontSize: '10px',
  padding: '4px 8px',
  minWidth: 'auto',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  fontWeight: '600',
  margin: 0
};

const toastConfig = {
  duration: 4000,
  position: 'top-center',
};

export const notify = {
  success: (msg) => toast.success(msg, {
    ...toastConfig,
    style: {
      ...toastStyle,
      background: '#10B981', // Green
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10B981',
    },
  }),
  error: (msg) => toast.error(msg, {
    ...toastConfig,
    style: {
      ...toastStyle,
      background: '#EF4444', // Red
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#EF4444',
    },
  }),
  warning: (msg) => toast(msg, {
    ...toastConfig,
    icon: '⚠️',
    style: {
      ...toastStyle,
      background: '#F59E0B', // Orange
      color: '#fff',
    },
  }),
  info: (msg) => toast(msg, {
    ...toastConfig,
    icon: 'ℹ️',
    style: {
      ...toastStyle,
      background: '#3B82F6', // Blue
      color: '#fff',
    },
  }),
};
