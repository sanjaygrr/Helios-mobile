import axios from 'axios';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export interface WeatherData {
    wind: {
        speed: number; // Meter/sec
        deg: number;   // Degrees
        gust?: number;
    };
    main: {
        temp: number;
        humidity: number;
    };
    weather: {
        main: string;
        description: string;
        icon: string;
    }[];
}

export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData | null> => {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                latitude: lat,
                longitude: lon,
                current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
                wind_speed_unit: 'ms',
                timezone: 'auto',
            }
        });
        const current = response.data?.current;
        if (!current) return null;
        return {
            wind: {
                speed: Number(current.wind_speed_10m) || 0,
                deg: Number(current.wind_direction_10m) || 0,
                gust: Number(current.wind_gusts_10m) || undefined,
            },
            main: {
                temp: Number(current.temperature_2m) || 0,
                humidity: Number(current.relative_humidity_2m) || 0,
            },
            weather: [{
                main: String(current.weather_code ?? ''),
                description: '',
                icon: '',
            }],
        };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return null;
    }
};
