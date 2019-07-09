import { Handler, Context, Callback } from 'aws-lambda';

interface TileRequest {
    layer: string
    x: number,
    y: number,
    z: number
}

export const handler:Handler = async (event: TileRequest, context: Context): Promise<any> => {
    console.log(`getRemainingTimeInMillis=${context.getRemainingTimeInMillis()}`);
    let response = JSON.stringify(event, null, 2);
    return Promise.resolve(response)
}