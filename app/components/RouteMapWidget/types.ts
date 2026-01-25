
export interface Coordinate {
    latitude: number;
    longitude: number;
}

export interface RouteMapWidgetProps {
    routeCoordinates: Coordinate[];
    startCoordinate?: Coordinate;
    endCoordinate?: Coordinate;
    style?: any;
    provider?: any;
}
