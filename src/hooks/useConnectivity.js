import { useConnectivityContext } from "../context/ConnectivityContext";

export const useConnectivity = () => {
  return useConnectivityContext();
};

export default useConnectivity;
