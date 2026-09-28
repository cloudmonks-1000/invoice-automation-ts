const oracleUser = process.env.ORACLE_USER;

if (!oracleUser) {
  throw new Error("ORACLE_USER is not configured");
}

const oraclePassword = process.env.ORACLE_PASSWORD;

if (!oraclePassword) {
  throw new Error("ORACLE_PASSWORD is not configured");
}

const oracleConnectString =
  process.env.ORACLE_CONNECT_STRING;

if (!oracleConnectString) {
  throw new Error(
    "ORACLE_CONNECT_STRING is not configured"
  );
}

export const env = {
  oracle: {
    user: oracleUser,
    password: oraclePassword,
    connectString: oracleConnectString,
  },
};