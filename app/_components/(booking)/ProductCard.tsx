"use client"
import { useState } from 'react';

 
export const ProductCard = () => {
    return(
        <>
            <h1>Add Product</h1>
            <div className="w-full">
{/*Head*/}
                <div className="flex border-b-1">
                    <div className="w-[30px] h-[30px] bg-gray-200 flex items-center justify-center rounded-2xl">
                        <span>1</span>{/*TODO: Fix to automatic*/}
                    </div>
                    <h1 className="text-center items-center">Chosen Product</h1>{/*TODO: Fix to automatic*/}
                </div>
{/*Body*/}
                <div>
                    <h1 className='font-bold'>Choose product</h1>
                    <select>{/*TODO: Fix to automatic*/}
                        <option value="choose" disabled>Choose</option>
                        <option value="Washing Machine">Washing Machine</option>
                        <option value="Dishwasher">Dishwasher</option>
                    </select>
                    <h1 className='font-bold'>Choose delivery type</h1>

                    <select>{/*TODO: Fix to automatic*/}
                        <option value="choose" disabled>Choose</option>
                        <option value="First step">First step</option>
                        <option value="Installation">Installation</option>
                    </select>

                    <h1 className='font-bold'>if installation choose </h1>{/*TODO: Fix to automatic*/}
                    <label className='block'>Depends on product
                        <input type="checkbox" name="1" />
                    </label>
                    <label className='block'>Depends on product
                        <input type="checkbox" name="2" />
                    </label>

                    <h1 className='font-bold'>Return</h1>
                    <label className='block'>Return to store
                        <input type="radio" name="1" />
                    </label>
                    <label className='block'>Return to trash
                        <input type="radio" name="2" />
                    </label>
                    <h1 className='font-bold'>Product amount</h1>
                    <label>
                        <input defaultValue={1}></input>
                    </label>
                    
                </div>
            </div>
        </>
    )
}