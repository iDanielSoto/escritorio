import React from 'react';

const DynamicLoader = ({ text, size = "large", layout = "col", className = "" }) => {
    const sizes = {
        large: { container: "w-24 h-24", img: "w-20 h-20", padding: "py-12" },
        medium: { container: "w-16 h-16", img: "w-14 h-14", padding: "py-8" },
        small: { container: "w-10 h-10", img: "w-8 h-8", padding: "py-4" },
        tiny: { container: "w-6 h-6", img: "w-5 h-5", padding: "py-0" }
    };

    const currentSize = sizes[size] || sizes.large;
    const flexDirection = layout === 'row' ? 'flex-row gap-2' : 'flex-col';

    return (
        <div className={`flex ${flexDirection} items-center justify-center ${currentSize.padding} ${className}`}>
            <div className={`relative ${currentSize.container} ${(text && layout === 'col') ? 'mb-2' : ''} flex items-center justify-center`}>
                <img
                    src="./images/loading.gif"
                    alt="Cargando..."
                    className={`${currentSize.img} object-contain`}
                />
            </div>
            {text && <p className="text-sm text-gray-400 font-medium animate-pulse">{text}</p>}
        </div>
    );
};

export default DynamicLoader;
