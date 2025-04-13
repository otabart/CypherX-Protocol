import { NextApiRequest, NextApiResponse } from "next";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return res.status(200).json({ email: user.email, displayName: user.displayName || email });
  } catch (error) {
    return res.status(401).json({ error: error.message || "Login failed" });
  }
}