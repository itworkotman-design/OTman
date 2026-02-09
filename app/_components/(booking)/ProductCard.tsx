"use client"
import { useState } from 'react';

 
export const ProductCard = () => {
    return(
        <>
            <div className="w-full px-8 py-8 mt-4 rounded-2xl border">
{/*Head*/}
                <div className="flex border-b-1 pb-2 mb-4">
                    <div className="w-[24px] h-[24px] bg-gray-200 flex items-center justify-center rounded-2xl mr-2">
                        <span>1</span>{/*TODO: Fix to automatic*/}
                    </div>
                    <h1 className="text-center items-center">Chosen Product</h1>{/*TODO: Fix to automatic*/}
                </div>
{/*Body*/}
                <div>
                    <h1 className='font-bold mb-2'>Choose product</h1>
                    <select className='w-full py-2 px-2 rounded-xl border'>{/*TODO: Fix to automatic*/}
                        <option value="disabled" aria-disabled>Choose</option>
                        <option value="Washing Machine">Washing Machine</option>
                        <option value="Dishwasher">Dishwasher</option>
                    </select>

                    <h1 className='font-bold my-2'>Choose delivery type</h1>
                    <select className='w-full py-2 px-2 rounded-xl border'>{/*TODO: Fix to automatic*/}
                        <option value="disabled" aria-disabled>Choose</option>
                        <option value="First step">First step</option>
                        <option value="Installation">Installation</option>
                    </select>

                    <h1 className='font-bold my-2'>If installation choose </h1>{/*TODO: Fix to automatic*/}
                    <label className='block'>
                        <input className='inline mr-2' type="checkbox" name="1" />
                        <p className='inline'>Depends on product</p>
                    </label>
                    <label className='block'>
                        <input className='inline mr-2' type="checkbox" name="2" />
                        <p className='inline'>Depends on product</p>
                    </label>

                    <h1 className='font-bold my-2'>Return</h1>
                    <label className='block'>
                        <input className='inline mr-2' type="radio" name="return" />
                        <p className='inline'>Return to store</p>
                    </label>
                    <label className='block my-2'>
                        <input className='inline mr-2' type="radio" name="return" />
                        <p className='inline'>Return to trash</p>
                    </label>
                    <h1 className='font-bold my-2'>Product amount</h1>
                    <label>
                        <input defaultValue={1} className='w-full py-2 px-2 rounded-xl border'></input>
                    </label>
                    
                </div>
            </div>
        </>
    )
}