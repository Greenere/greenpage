import { Paragraph } from "../components/StyledTextBlocks"

const ResearchIntro: React.FC = ()=>{
    return (
        <Paragraph>
            I used to conduct some research in the domain of 
            adversarial machine learning and computer vision
        </Paragraph>
    )
}

const TravelIntro: React.FC = ()=>{
    return (
        <Paragraph>
            I enjoy traveling and photography and find it intriguing 
            to be able to witness those miraculous places in the world 
            before they gets eroded.
        </Paragraph>
    )
}

const BlogIntro: React.FC = ()=>{
    return (
        <Paragraph>
            I write blogs about tech, history, thoughts and my experiences,
            primarily on Zhihu, Rednote.
        </Paragraph>
    )
}

const EduIntro: React.FC = ()=>{
    return (
        <Paragraph>
            I got my master's degree from Cornell University and my undergraduate 
            degree from Huazhong University of Science and Technology.
        </Paragraph>
    )
}

export {ResearchIntro, TravelIntro, BlogIntro, EduIntro}