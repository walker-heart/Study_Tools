
import admin from 'firebase-admin';
import { env } from './env';

const serviceAccount = {
  "type": "service_account",
  "project_id": "wtoolsw-503cd",
  "private_key_id": "2c52d2f1262935775666c44faee3d661c86d2070",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCk3QfJrN+TRwyw\n2EgpAF37YtAlyfmZXLiEZf7mP7u5vHfPQahY7kqf8secVksssxJTzvL5IUjDA+uG\nWUSx9WTgfJfqwjXzxsRx60KdS1TiCdZoKxRZWcSkk9C1iIbvhDvclk16SichuzvM\nbfmxOR8bwxCIgeJFb5nQjWsJ4pMxxRZB/mks2UJ1uz0WHO5PQI0+vU6CFJMT2Fsa\nrVPNUw9X1NRCqPUiok9hxAI+6L+NPePQHQDRJd7gV/z+xs759KHrjFMdSzorIjBY\nZzwfPhFx7cO5JeAUkgFdo7Qgwp4LcO2BOYqVtLy3vJfsKDjoWJn429dQtcj1folJ\ni97wp04/AgMBAAECggEAARrMEuPfpr6vda5Xlzrrwf6JU9OsdKFGF4onijnt5+FT\nvYEBPhJKr6/7i54IhwnKWC9jUPuOSoqAJ0W8qWJVjp4HGzj+hHMFrJSLfDN3f3tn\nx+8GgDWDxsFmcahbA6VlqUmm/AbRM+PprCBfcnqOSCZijBhUYBPeBALsL0j7E3O/\n4ZM/mHGeNOZqDrby/syRnqkfa/t6ZHTBxw6U4OYjL9loT0C9Zw95TC9eszx5RvNK\nSMYsr5RZOAeqCbP9/41kiLymMq+iRvVxUXmMl/9lO1hsRgzgmyds2cGu9Het5lmr\n0PRC5f33smO9m2Zk98yfVQ6L6IrPaPEDSFbvp13x0QKBgQDn1N2VVvYJ7ACVdtrm\nfE++eWFLH6SZrW+v0K7YSg+xOKfour9NDXW/mThl2avK0QHyr0F6u56E07oOR7FB\nDfy6T1ylxQlS0sFETvg88BrPekKpFwQEsAdgFm8dz63l1O8VvmjRxXWpqTet2VYQ\n1CYiqI5PL4psuDChZk5Q03l9UwKBgQC2DOpoZrrjBMgfXjbahE/N6jyAoD8eCOHO\nmgZrqqSljA+cDdpPDIlU3itvuCcYgFqdgmOS4PI0QgNqdrtO2B6pIZQQOi4zM+2h\nF18aiwswAwY3ay9BtxzodZDsu9rexpoOZ21j/OZMDHaK1Dmsz/oIfmJfnA+HFq/D\n+2xnsBOh5QKBgGkJU9++x7jVGaqecC1vcz3shr1ft9b88pZo6V8LpzJ3ZfQW8Ge7\nynaluBzFU4WPzt8isnsmGHs75pdjuhasfK35GRPuQvwoivIlCWmqq6sHTL6JtANf\nsefCIlQSbUqtgCmM3Lb2TQoypgx5ZPo49JJNZjTQaFo71aS60o7iUbALAoGADTBq\nWx32NDRIe11MBBDJ51UtBPSXHgnushUemfZG72dyShAG3Os/l9JwuytQScoixn6H\n0EBTy81sie4IK/IkZoR0Qai1aCg+8wjKbxXbvaK6dJFjXxNxGLZLxZrmhHVG+/wq\nRLAxzxioDe7KLubyamMdpWedCGBwY3Z3qBttkLECgYAfDae6KttwAJWdxGCrbqiR\nJBMzagZetXhenCVfAie7XEyG5uziLHz78CMPJUZ3r3q9/yJ2J/tI3oLMJ3qwmt9z\nrtEIKnhEwRMrdJFVdgvMou39yip2eYssa9Nmk79fyn1I6OpRc0H5gW676WguKJ6D\nn+a1WrCv3zPt3f6AgXIl1w==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-6i7f7@wtoolsw-503cd.iam.gserviceaccount.com",
  "client_id": "113497347140895384017",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-6i7f7%40wtoolsw-503cd.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export const auth = admin.auth(app);
export const firestore = admin.firestore(app);
