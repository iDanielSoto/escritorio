using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BiometricMiddleware.Adapters
{
    public static class ReaderFactory
    {
        public static async Task<IFingerprintReader> AutoDetectReader()
        {
            Console.WriteLine("[FACTORY] Detectando lectores...\n");

            var adapter = new DigitalPersonaAdapter();

            try
            {
                bool initialized = await adapter.Initialize();

                if (initialized && adapter.IsConnected)
                {
                    Console.WriteLine($"[FACTORY] Lector detectado: {adapter.ReaderBrand}");
                    Console.WriteLine($"          Modelo: {adapter.DeviceModel}\n");
                    return adapter;
                }
                else
                {
                    adapter.Dispose();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FACTORY] Error: {ex.Message}");
                adapter.Dispose();
            }

            Console.WriteLine("[FACTORY] No se detecto ningun lector\n");
            return null;
        }

        public static async Task<IFingerprintReader> CreateReader(string brand)
        {
            IFingerprintReader reader;

            switch (brand.ToLower())
            {
                case "digitalpersona":
                case "dp":
                    reader = new DigitalPersonaAdapter();
                    break;
                default:
                    throw new ArgumentException($"Marca no soportada: {brand}");
            }

            bool initialized = await reader.Initialize();

            if (!initialized)
            {
                throw new Exception($"No se pudo inicializar el lector {brand}");
            }

            return reader;
        }
    }
}
