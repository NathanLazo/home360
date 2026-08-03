import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;
const DUMMY_PASSWORD = "home360-auth-timing-placeholder";

let dummyHashPromise: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash(DUMMY_PASSWORD, BCRYPT_COST);
  return dummyHashPromise;
}

export const hashPassword = (plainPassword: string): Promise<string> =>
  bcrypt.hash(plainPassword, BCRYPT_COST);

export const verifyPassword = async (
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> => {
  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
};

export async function verifyPasswordOrDummy(
  plainPassword: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  const comparisonHash = passwordHash ?? (await getDummyPasswordHash());
  const isValid = await verifyPassword(plainPassword, comparisonHash);

  return passwordHash !== null && passwordHash !== undefined && isValid;
}
