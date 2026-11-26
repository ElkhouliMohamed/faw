import {notFound} from "next/navigation";
import {contentPage} from "@/lib/content";
import {ContentView} from "@/components/content-page";
import type {Metadata} from "next";
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const page=await contentPage("page",slug);return {title:page?.seoTitle||page?.title,description:page?.seoDescription||undefined,alternates:{canonical:`/pages/${slug}`}};}
export default async function Page({params}:Props){const {slug}=await params;const page=await contentPage("page",slug);if(!page)notFound();return <ContentView page={page}/>;}
