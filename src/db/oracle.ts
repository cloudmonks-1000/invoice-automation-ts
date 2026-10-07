import oracledb from "oracledb";

import { env } from "@/src/config/env";

const oraclePoolPromise =
  oracledb.createPool({
    user: env.oracle.user,
    password: env.oracle.password,
    connectString:
      env.oracle.connectString,

    // Keep a reasonable number of
    // warm Oracle connections.
    poolMin: 10,

    // Do NOT allow every VU to create
    // an Oracle connection.
    poolMax: 30,

    // Grow gradually during load.
    poolIncrement: 5,

    // Close idle connections after 60 seconds.
    poolTimeout: 60,

    // Wait up to 30 seconds for a
    // connection from the pool.
    queueTimeout: 30000,
  });

export async function getOracleConnection() {
  const pool =
    await oraclePoolPromise;

  return pool.getConnection();
}