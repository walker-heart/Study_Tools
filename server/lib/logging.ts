interface LogMessage {
  message: string;
  [key: string]: any;
}

export function debug(data: LogMessage) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(JSON.stringify(data, null, 2));
  }
}

export function info(data: LogMessage | string) {
  const message = typeof data === 'string' ? { message: data } : data;
  console.info(JSON.stringify(message, null, 2));
}

export function warn(data: LogMessage) {
  console.warn(JSON.stringify(data, null, 2));
}

export function error(data: LogMessage) {
  console.error(JSON.stringify(data, null, 2));
} 