import oracledb from "oracledb";
import { env } from "@/src/config/env";

const oraclePoolPromise = oracledb.createPool({
  user: env.oracle.user,
  password: env.oracle.password,
  connectString: env.oracle.connectString,
  poolMin: 1,
  poolMax: 10,
  poolIncrement: 1,
});

export async function getOracleConnection() {
  const pool = await oraclePoolPromise;
  return pool.getConnection();
}